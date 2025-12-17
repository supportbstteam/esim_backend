// src/controllers/cms.controller.ts
import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Page } from "../../entity/Page.entity";
import { PageSection } from "../../entity/PageSection.entity";

export const savePage = async (req: Request, res: Response) => {
  const { page, sections } = req.body;

  if (!page || !Array.isArray(sections)) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  const pageRepo = AppDataSource.getRepository(Page);
  const sectionRepo = AppDataSource.getRepository(PageSection);

  // Check if page exists
  let pageEntity = await pageRepo.findOne({
    where: { page },
    relations: ["sections"],
  });

  if (!pageEntity) {
    pageEntity = pageRepo.create({ page });
    await pageRepo.save(pageEntity);
  }

  // Delete old sections (simplest + safest)
  await sectionRepo.delete({ page: { id: pageEntity.id } });

  // Insert new sections
  const newSections = sections.map((s: any) =>
    sectionRepo.create({
      template: s.template,
      data: s.data,
      page: pageEntity,
    })
  );

  await sectionRepo.save(newSections);

  return res.json({
    message: "Page saved successfully",
    page,
  });
};
