// src/controllers/cms.controller.ts
import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Page } from "../../entity/Page.entity";
import { PageSection } from "../../entity/PageSection.entity";

export const getPage = async (req: any, res: Response) => {
  const { page } = req.params;

  const pageRepo = AppDataSource.getRepository(Page);

  const pageEntity = await pageRepo.findOne({
    where: { page },
    relations: ["sections"],
    order: {
      sections: {
        order: "ASC", // ✅ THIS IS THE FIX
      },
    },
  });

  if (!pageEntity) {
    return res.status(404).json({ message: "Page not found" });
  }

  return res.json({
    page: pageEntity.page,
    id: pageEntity?.id,
    // ✅ SEO fields
    metaTitle: pageEntity.metaTitle || "",
    metaDescription: pageEntity.metaDescription || "",
    metaKeywords: pageEntity.metaKeywords || [],
    sections: pageEntity.sections.map((s) => ({
      id: s.id,
      template: s.template,
      data: s.data,
    })),
  });
};

export const getAllPages = async (req: any, res: Response) => {
  try {
    /* ---------------- AUTH CHECK ---------------- */

    const pageRepo = AppDataSource.getRepository(Page);

    const pages = await pageRepo.find({
      relations: ["sections"],
      order: {
        createdAt: "DESC",
      },
    });

    return res.json({
      total: pages.length,
      pages: pages.map((page) => ({
        id: page.id,
        page: page.page,
        sections: page.sections.map((s) => ({
          id: s.id,
          template: s.template,
          data: s.data,
        })),
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      })),
    });
  } catch (err) {
    console.error("❌ getAllPages error:", err);
    return res.status(500).json({
      message: "Failed to fetch pages",
    });
  }
};
