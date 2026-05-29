import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

export interface ProcessedImage {
  filename: string;
  path: string;
  size: number;
  width: number;
  height: number;
}

function generateHash(filename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const hash = crypto.createHash('sha256');
  hash.update(`${filename}-${timestamp}-${random}`);
  return hash.digest('hex').substring(0, 32);
}

export async function processImage(
  inputPath: string,
  outputDir: string,
  originalName: string
): Promise<ProcessedImage> {
  const hash = generateHash(originalName);
  const outputFilename = `${hash}.webp`;
  const outputPath = path.join(outputDir, outputFilename);
  
  const metadata = await sharp(inputPath).metadata();
  
  let sharpInstance = sharp(inputPath);
  
  if (metadata.width && metadata.width > 1200) {
    sharpInstance = sharpInstance.resize(1200, null, {
      withoutEnlargement: true,
      fit: 'inside'
    });
  }
  
  await sharpInstance
    .webp({
      quality: 80,
      effort: 6,
      lossless: false
    })
    .toFile(outputPath);
  
  const stats = fs.statSync(outputPath);
  const processedMetadata = await sharp(outputPath).metadata();
  
  return {
    filename: outputFilename,
    path: outputPath,
    size: stats.size,
    width: processedMetadata.width || 0,
    height: processedMetadata.height || 0
  };
}