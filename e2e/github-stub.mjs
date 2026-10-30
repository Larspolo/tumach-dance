// A stub of the GitHub API for the page "For Nina" (#68): one open `for-nina` question. A comment closes it, as a
// run does after it reads the answer. `GET /__comments` gives the comments to the test.
import { createServer } from "node:http";

const issue = {
  number: 901,
  title: "Question for Nina: the color of the book button",
  body: "## For Nina\nWhich color do you like for the book button?\nTry: /en/book\n- A. Dark\n- B. Light\n",
  labels: [{ name: "for-nina" }],
};
let open = true;
const comments = [];

createServer((req, res) => {
  const json = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/__comments") return json(200, comments);
  if (url.pathname.endsWith("/issues") && req.method === "GET") return json(200, open ? [issue] : []);
  if (url.pathname.endsWith(`/issues/${issue.number}`)) return json(200, issue);
  if (url.pathname.endsWith(`/issues/${issue.number}/comments`) && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      comments.push(JSON.parse(body).body);
      open = false;
      json(201, { id: comments.length });
    });
    return;
  }
  json(404, { message: "Not Found" });
}).listen(Number(process.env.PORT ?? 3101));
