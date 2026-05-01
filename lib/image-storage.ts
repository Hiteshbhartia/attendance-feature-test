import fs from 'fs/promises';
import path from 'path';

export async function saveBase64Image(base64: string, folder: string): Promise<string> {
  const matches = base64.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) throw new Error('Invalid base64 string');

  const extension = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${extension}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
  
  await fs.mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, filename);
  
  await fs.writeFile(filePath, buffer);
  
  return `/uploads/${folder}/${filename}`;
}
