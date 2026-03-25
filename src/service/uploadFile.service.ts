import { AppDataSource } from "../data-source";
import { Image } from "../entity/Images.entity";

export const uploadFileAndGetUrl = async (
  file: Express.Multer.File,
  name?: string,
): Promise<string> => {
  const repo = AppDataSource.getRepository(Image);

  const filePath = `/uploadsimg/${file.filename}`;

  const image = repo.create({
    originalName: file.originalname,
    fileName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    name: name || null,
    filePath,
  });

  await repo.save(image);

  return filePath;
};
