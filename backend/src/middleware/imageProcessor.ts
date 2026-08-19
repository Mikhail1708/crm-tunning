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
  try {
    const hash = generateHash(originalName);
    const outputFilename = `${hash}.webp`;
    const outputPath = path.join(outputDir, outputFilename);
    
    console.log(`Processing: ${inputPath} -> ${outputPath}`);
    
    const metadata = await sharp(inputPath).metadata();
    console.log(`Original: ${metadata.width}x${metadata.height}, ${metadata.size} bytes`);
    
    let sharpInstance = sharp(inputPath);
    
    // Уменьшаем если слишком большое
    if (metadata.width && metadata.width > 1200) {
      sharpInstance = sharpInstance.resize(1200, null, {
        withoutEnlargement: true,
        fit: 'inside'
      });
      console.log('Resizing to max 1200px');
    }
    
    // Конвертируем в webp с сжатием
    await sharpInstance
      .webp({
        quality: 80,
        effort: 6,
        lossless: false
      })
      .toFile(outputPath);
    
    const stats = fs.statSync(outputPath);
    const processedMetadata = await sharp(outputPath).metadata();
    
    console.log(`Processed: ${processedMetadata.width}x${processedMetadata.height}, ${stats.size} bytes`);
    
    return {
      filename: outputFilename,
      path: outputPath,
      size: stats.size,
      width: processedMetadata.width || 0,
      height: processedMetadata.height || 0
    };
  } catch (error) {
    console.error('Error in processImage:', error);
    throw error;
  }
}