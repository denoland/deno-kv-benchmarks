#!/bin/bash

tls_file_dir=/etc/deno-region-proxy-server
tls_cert_file=$tls_file_dir/cert.txt
tls_key_file=$tls_file_dir/key.txt
openssl_cert_config_file=$tls_file_dir/openssl.config
openssl_cert_config_file_final=$tls_file_dir/openssl.config.final
script_file=/usr/local/bin/deno-region-proxy-server.ts
systemd_unit=deno-region-proxy-server.service
systemd_unit_file=/etc/systemd/system/$systemd_unit

mkdir -p "$tls_file_dir"
mkdir -p "$(dirname "$systemd_unit_file")"
mkdir -p "$(dirname "$script_file")"

# OpenSSL self-signed config
read -r -d '' openssl_cert_config <<CERT_CONFIG
# https://unix.stackexchange.com/a/322083
[ req ]
default_bits = 2048
default_keyfile = server-key.pem
distinguished_name = subject
req_extensions = req_ext
x509_extensions = x509_ext
string_mask = utf8only

[ subject ]
countryName = Country Name (2 letter code)
countryName_default = US
stateOrProvinceName = State or Province Name (full name)
stateOrProvinceName_default = NY
localityName = Locality Name (eg, city)
localityName_default = New York
organizationName = Organization Name (eg, company)
organizationName_default = Example, LLC
commonName = Common Name (e.g. server FQDN or YOUR name)
commonName_default = Example Company
emailAddress = Email Address
emailAddress_default = test@example.com

[ x509_ext ]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
subjectAltName = @alternate_names
nsComment = "OpenSSL Generated Certificate"

[ req_ext ]
subjectKeyIdentifier = hash
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
subjectAltName = @alternate_names
nsComment = "OpenSSL Generated Certificate"

[ alternate_names ]
DNS.1 = deno-kv.example.com
IP.1 = deno-kv.example.com
CERT_CONFIG

# Persist the config
printf %s "$openssl_cert_config" > "$openssl_cert_config_file"

# Install prerequisites
export DENO_INSTALL=/usr/local
apt update && apt install unzip curl -y
curl -fsSL https://deno.land/install.sh | sh

# Deno server script
read -r -d '' server_script_src <<'TYPESCRIPT'
  let tlsCert = "";
  let tlsKey = "";
  let certIsCreated = false;
  let tcpServerHasStarted = false;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  // The secrets are substituted dynamically in the Terraform config
  const requestSecret = "%DENO_KV_FRONTEND_SECRET%";
  const requestSecretHeader = "%DENO_KV_FRONTEND_SECRET_HEADER%";
  const combinedHeaderAndSecret = `${requestSecretHeader}: ${requestSecret}`;
  const encodedHeaderAndSecret = encoder.encode(combinedHeaderAndSecret);
  const pathCertSecret = `/deno/kv-bench/secret/${requestSecretHeader}/${requestSecret}/`;

  async function loadCerts(ip: string | null, isAfterCreating = false) {
    try {
      tlsCert = await Deno.readTextFile("%tls_cert_file%");
      tlsKey = await Deno.readTextFile("%tls_key_file%");
      certIsCreated = true;
    } catch (error) {
      if (!ip) {
        return;
      }

      // The cert files most likely don't exist yet; let's create them
      // FIXME: This creates a race-condition in the initialization stage.
      // While waiting for the certificates to be created another client
      // could request another certificate before the new one finishes on
      // time. I'm not handling this scenario as it only happens on the
      // VM's first request and doesn't seem all that important an edge case.

      // Create a self-signed cert
      const configTemplate = await Deno.readTextFile("%openssl_cert_config_file%");
      await Deno.writeTextFile(
        "%openssl_cert_config_file_final%",
        configTemplate.replaceAll("deno-kv.example.com", ip),
      );

      const command = new Deno.Command("openssl", {
        args: [
          "req", "-x509",
          "-batch",
          "-config", "%openssl_cert_config_file_final%",
          "-nodes",
          "-days", "365",
          "-newkey", "rsa:2048",
          "-out", "%tls_cert_file%",
          "-keyout", "%tls_key_file%"
        ],
        stdin: "null",
        stdout: "piped",
        stderr: "piped",
      });
      const { success, stdout, stderr } = await command.output();
      certIsCreated = success;

      if (success) {
        if (!isAfterCreating) {
          // If we're here after creating a certificate again then we'll
          // just be stuck in an infinite loop. Use that as a halting condition
          await loadCerts(ip, true);
        }
      } else {
        console.error(`error: failed to create certificate; stdout:\n${stdout}\n\nstderr:\n${stderr}`);
      }
    }
  }

  // Try to load the certs early if they already exist
  await loadCerts(null);

  // HTTP server for certificate
  Deno.serve({
    port: 8089,
  }, async (request) => {
    const { pathname } = new URL(request.url, "https://deno.com");
    if (!pathname.startsWith(pathCertSecret)) {
      return new Response("");
    }

    if (certIsCreated) {
      startTcpServer();
    } else {
      const ip = pathname.slice(pathCertSecret.length);
      await loadCerts(ip);

      if (certIsCreated) {
        startTcpServer();
      }
    }

    // FIXME: this could potentially return an empty response which
    // would indicate that certificate creation failed.
    return new Response(tlsCert);
  });

  async function startTcpServer() {
    if (tcpServerHasStarted) {
      return false;
    }
    tcpServerHasStarted = true;

    // TCP server for requests
    const listener = Deno.listenTls({
      cert: tlsCert,
      key: tlsKey,
      port: 8989,
    });

    for await (const conn of listener) {
      (async () => {
        const hostname = "hostname" in conn.remoteAddr && conn.remoteAddr.hostname || "-no-hostname-";

        try {
          // Request binary repr: [HEADER][SECRET][32bit request size][request]
          // Response binary repr: [32bit response size][request]
          const headerSecretBuffer = new Uint8Array(encodedHeaderAndSecret.length);
          const secretBytesRead = await conn.read(headerSecretBuffer);

          const isValidSecret = secretBytesRead === encodedHeaderAndSecret.length
            && headerSecretBuffer.every((byte, index) => encodedHeaderAndSecret[index] === byte);
          if (!isValidSecret) {
            console.log("invalid secret");
            conn.close();
            return;
          }

          const requestSizeBuffer = new Uint32Array(1);

          await conn.read(new Uint8Array(requestSizeBuffer.buffer));
          const requestBuffer = new Uint8Array(requestSizeBuffer[0]);
          await conn.read(requestBuffer);
          const requestUrl = decoder.decode(requestBuffer);

          console.log(`connection: host:${hostname} url:${requestUrl}`);

          const response = await (await fetch(requestUrl, {
            headers: {
              [requestSecretHeader]: requestSecret,
            },
          })).text();
          const responseBuffer = encoder.encode(JSON.stringify(response));
          const responseSizeBuffer = new Uint32Array([responseBuffer.length]);
          await conn.write(new Uint8Array(responseSizeBuffer.buffer));
          await conn.write(responseBuffer);
        } catch (error) {
          console.error(`error: host:${hostname}`, error);
        }
      })();
    }
  }
TYPESCRIPT

# Remove indentation
indentation=$'\n  '
newline=$'\n'
server_script_src=${server_script_src//$indentation/$newline}
server_script_src=${server_script_src//%tls_cert_file%/$tls_cert_file}
server_script_src=${server_script_src//%tls_key_file%/$tls_key_file}
server_script_src=${server_script_src//%openssl_cert_config_file%/$openssl_cert_config_file}
server_script_src=${server_script_src//%openssl_cert_config_file_final%/$openssl_cert_config_file_final}

# Save Deno script
printf %s "$server_script_src" > "$script_file"

deno_server_command=(
  deno run
  --allow-net
  --allow-read=/etc/deno-region-proxy-server
  --allow-write="$openssl_cert_config_file_final"
  --allow-run=openssl
  "$script_file"
)

read -r -d '' systemd_unit_src <<SYSTEMD
  [Unit]
  Description=Deno KV Benchmark Region Proxy Server
  After=network.target

  [Service]
  Type=simple
  Restart=always
  ExecStart=${deno_server_command[0]} $(printf '"%s" ' "${deno_server_command[@]:1}")

  [Install]
  WantedBy=default.target
SYSTEMD

# Remove indentation
systemd_unit_src=${systemd_unit_src//$indentation/$newline}

# Install & start systemd unit
printf %s "$systemd_unit_src" > "$systemd_unit_file"
systemctl start "$systemd_unit"
systemctl enable "$systemd_unit"

echo "Finished setup."
