import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import { createAudioFileFromText } from "./elevenlabs";
import path from "path";

const app = express();
const PORT = 3000;

app.use(express.static("public"));

app.use(bodyParser.json());

app.post("/text-to-speech", async (req: Request, res: Response) => {
  const { text, emotion } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    const audioFileName = await createAudioFileFromText(text, emotion);
    res.json({ audioFileName: `/audio/${audioFileName}` }); // Adjust the path
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
