import functions from "@google-cloud/functions-framework";

functions.http("denoCloudFn", (req, res) => {
  res.contentType("text/html; charset=UTF-8");
  res.end(`<h1>Time to Cloud Function</h1><p>Firestore is the next stop</p><p>URL: ${req.url}</p>\n`);
});
