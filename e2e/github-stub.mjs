// A stub of the GitHub API for the browser tests (#108): the server calls it with GITHUB_API_URL. No data is kept.
import { createServer } from "node:http";

const port = Number(process.argv[2] || 3199);
createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.method === "POST") {
    res.statusCode = 201;
    res.end(JSON.stringify({ number: 1 }));
  } else {
    res.end(req.url === "/" ? "{}" : "[]");
  }
}).listen(port);
