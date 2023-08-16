resource "google_compute_firewall" "gcp_vm_firewall" {
  name    = "deno-vm-firewall"
  network = google_compute_network.gcp_vm_network.name

  allow {
    protocol = "icmp"
  }

  allow {
    protocol = "tcp"
    ports    = ["22", "8089", "8989"]
  }
}

resource "google_compute_network" "gcp_vm_network" {
  name = "deno-vm-network"
}

resource "google_compute_instance" "gcp_vm" {
  name                      = "deno-kv-region-proxy"
  machine_type              = "e2-micro"
  allow_stopping_for_update = true
  # zone                      = "${local.gcp_region}-a"
  zone                      = "us-east4-a" # Deno KV primary region

  boot_disk {
    auto_delete = true
    initialize_params {
      image = "projects/ubuntu-os-cloud/global/images/ubuntu-2204-jammy-v20230727"
      size  = 10
    }
  }

  network_interface {
    network = google_compute_network.gcp_vm_network.name
    access_config {
      // Ephemeral public IP
    }
  }

  metadata_startup_script = replace(
    replace(
      file("./startup/gcp_vm_startup.sh"),
      "%DENO_KV_FRONTEND_SECRET%",
      local.backend_service_secret
    ),
    "%DENO_KV_FRONTEND_SECRET_HEADER%",
    local.backend_service_secret_header
  )
}

output "gcp_vm_ip" {
  value = google_compute_instance.gcp_vm.network_interface.0.access_config.0.nat_ip
}
