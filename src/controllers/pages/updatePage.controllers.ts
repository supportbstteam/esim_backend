// src/controllers/cms.controller.ts
import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Page } from "../../entity/Page.entity";
import { PageSection } from "../../entity/PageSection.entity";

export const saveOrUpdatePage = async (req: Request, res: Response) => {
  const { page } = req.params;
  const { sections } = req.body;

  if (!page || !Array.isArray(sections)) {
    return res.status(400).json({
      message: "Invalid payload",
    });
  }

  const pageRepo = AppDataSource.getRepository(Page);
  const sectionRepo = AppDataSource.getRepository(PageSection);

  await AppDataSource.transaction(async (manager) => {
    const pageRepository = manager.getRepository(Page);
    const sectionRepository = manager.getRepository(PageSection);

    // 1️⃣ Find existing page
    let pageEntity = await pageRepository.findOne({
      where: { page },
      relations: ["sections"],
    });

    // 2️⃣ Create page if not exists
    if (!pageEntity) {
      pageEntity = pageRepository.create({ page });
      await pageRepository.save(pageEntity);
    }

    // 3️⃣ DELETE ALL OLD SECTIONS
    // 🔥 This automatically removes missing template4 or any other template
    await sectionRepository.delete({
      page: { id: pageEntity.id },
    });

    // 4️⃣ INSERT NEW SECTIONS IN EXACT FRONTEND ORDER
    const sectionEntities = sections.map((section, index) =>
      sectionRepository.create({
        page: pageEntity,
        template: section.template,
        data: section.data,
        order: index, // 🔒 source of truth
      })
    );

    await sectionRepository.save(sectionEntities);
  });

  return res.json({
    message: "Page saved successfully",
    page,
    sectionsCount: sections.length,
  });
};
