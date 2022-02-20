const express = require("express");
import path from "path";

const app = express();
const port = 8081;

app.use(express.static(path.join(__dirname, 'dist')));

app.get("/", (req, res) => {
    res.sendFile(path.resolve(__dirname, "dist", "index.html"));
})

app.listen(port, () => {
    console.log(`server started at http://localhost:${port}`)
})

