import { ElevenLabsClient } from "elevenlabs";
import { writeFile } from "fs/promises";
import { createWriteStream, readFileSync, writeFileSync } from "fs";
import { v4 as uuid } from "uuid";
import * as dotenv from "dotenv";
import wav from "node-wav";
import path from "path";
import { exec } from "child_process";

dotenv.config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const client = new ElevenLabsClient({
  apiKey: ELEVENLABS_API_KEY,
});

const findSilentIntervals = (data: Float32Array, sampleRate: number, threshold: number, minSilenceDuration: number) => {
  let silentIntervals: number[][] = [];
  let silentStart: number | null = null;
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) < threshold) {
      if (silentStart === null) {
        silentStart = i;
      } else if (i - silentStart >= sampleRate * minSilenceDuration) {
        silentIntervals.push([silentStart, i]);
        silentStart = null;
      }
    } else {
      silentStart = null;
    }
  }
  return silentIntervals;
};

const trimAudioData = (data: Float32Array, silentIntervals: number[][]): Float32Array => {
  if (silentIntervals.length === 0) {
    return data;
  }
  
  let lastInterval = silentIntervals[silentIntervals.length - 1];
  let endOfSilence = lastInterval[1];

  return new Float32Array(data.slice(0, endOfSilence));
};

export const createAudioFileFromText = async (
  text: string,
  emotion: string = "neutral"
): Promise<string> => {
  if (emotion.toLowerCase() === "angry") {
    text = `"${text}" <break time="1.5s" />  she shouted angrily.`;
  } else if (emotion.toLowerCase() === "sad") {
    text = `"${text}" <break time="1.5s" /> she said sadly.`;
  }

  return new Promise<string>(async (resolve, reject) => {
    try {
      const audioBuffer = await client.generate({
        voice: "Rachel",
        model_id: "eleven_turbo_v2_5",
        text,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.9,
          use_speaker_boost: true,
        }
      });

      const originalFileName = `${uuid()}.mp3`;
      const trimmedFileName = `${uuid()}_trimmed.wav`;
      const originalFilePath = path.join(__dirname, "../public/audio", originalFileName);
      const trimmedFilePath = path.join(__dirname, "../public/audio", trimmedFileName);

      await writeFile(originalFilePath, audioBuffer);

      await execPromise(`ffmpeg -i ${originalFilePath} ${originalFilePath.replace(".mp3", ".wav")}`);

      let buffer = readFileSync(originalFilePath.replace(".mp3", ".wav"));
      let result = wav.decode(buffer);

      let silentIntervals = findSilentIntervals(result.channelData[0], result.sampleRate, 0.01, 1.0);
      let trimmedData = trimAudioData(result.channelData[0], silentIntervals);

      let encoded = wav.encode([trimmedData], { sampleRate: result.sampleRate, float: true });
      writeFileSync(trimmedFilePath, Buffer.from(encoded));

      resolve(trimmedFileName);
    } catch (error) {
      reject(error);
    }
  });
};

const execPromise = (cmd: string) => {
  return new Promise<void>((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};
