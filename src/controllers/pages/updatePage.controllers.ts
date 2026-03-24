import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";

import { Page } from "../../entity/Page.entity";
import { PageSection } from "../../entity/PageSection.entity";
import { Banner } from "../../entity/Banner.entity";

// export const saveOrUpdatePage = async (
//   req: any,
//   res: Response
// ) => {

//   const { page } = req.params;

//   const {
//     sections,
//     banner,
//     id
//   } = req.body;

//   if (!page || !Array.isArray(sections)) {
//     return res.status(400).json({
//       message: "Invalid payload",
//     });
//   }

//   console.log("-=-=- banner -=-=--=", id);

//   await AppDataSource.transaction(
//     async (manager) => {

//       const pageRepository =
//         manager.getRepository(Page);

//       const sectionRepository =
//         manager.getRepository(PageSection);

//       const bannerRepository =
//         manager.getRepository(Banner);

//       /* ================= FIND OR CREATE PAGE ================= */

//       let pageEntity =
//         await pageRepository.findOne({
//           where: { id },
//           relations: [
//             "sections",
//             "banner",
//           ],
//         });

//       if (!pageEntity) {

//         pageEntity =
//           pageRepository.create({
//             page,
//           });

//         await pageRepository.save(
//           pageEntity
//         );

//       }

//       /* ================= SAVE OR UPDATE BANNER ================= */

//       if (banner) {

//         let bannerEntity =
//           await bannerRepository.findOne({
//             where: {
//               page: {
//                 id: pageEntity.id,
//               },
//             },
//             relations: ["page"],
//           });

//         // CREATE banner
//         if (!bannerEntity) {

//           bannerEntity =
//             bannerRepository.create({

//               heading:
//                 banner.heading || "",

//               subHeading:
//                 banner.subHeading || "",

//               page:
//                 pageEntity,

//             });

//         }

//         // UPDATE banner
//         else {

//           bannerEntity.heading =
//             banner.heading || "";

//           bannerEntity.subHeading =
//             banner.subHeading || "";

//         }

//         await bannerRepository.save(
//           bannerEntity
//         );

//       }

//       /* ================= DELETE OLD SECTIONS ================= */

//       await sectionRepository.delete({
//         page: {
//           id: pageEntity.id,
//         },
//       });

//       /* ================= INSERT NEW SECTIONS ================= */

//       const sectionEntities =
//         sections.map(
//           (
//             section: any,
//             index: number
//           ) =>

//             sectionRepository.create({

//               page:
//                 pageEntity,

//               template:
//                 section.template,

//               data:
//                 section.data,

//               order:
//                 index,

//             })
//         );

//       await sectionRepository.save(
//         sectionEntities
//       );

//     }
//   );

//   return res.json({

//     success: true,

//     message:
//       "Page saved successfully",

//     page,

//     sectionsCount:
//       sections.length,

//   });

// };

// src/controllers/cms.controller.ts

// import { Request, Response } from "express";
// import { AppDataSource } from "../data-source";
// import { Page } from "../entity/Page.entity";
// import { PageSection } from "../entity/PageSection.entity";
// import { Banner } from "../entity/Banner.entity";

export const saveOrUpdatePage = async (req: any, res: Response) => {
  try {
    const { page } = req.params;

    const { id, sections, banner, metaTitle, metaDescription, metaKeywords } =
      req.body;

    /* ================= VALIDATION ================= */

    if (!page) {
      return res.status(400).json({
        success: false,
        message: "Page slug is required",
      });
    }

    if (!Array.isArray(sections)) {
      return res.status(400).json({
        success: false,
        message: "Sections must be an array",
      });
    }

    /* ================= TRANSACTION ================= */

    const result = await AppDataSource.transaction(async (manager) => {
      const pageRepository = manager.getRepository(Page);

      const sectionRepository = manager.getRepository(PageSection);

      const bannerRepository = manager.getRepository(Banner);

      /* ================= FIND OR CREATE PAGE ================= */

      let pageEntity: Page | null = null;

      // find by id if exists
      if (id) {
        pageEntity = await pageRepository.findOne({
          where: { id },
          relations: ["sections", "banner"],
        });
      }

      // CREATE NEW PAGE
      if (!pageEntity) {
        pageEntity = pageRepository.create({
          page,
          metaTitle,
          metaDescription,
          metaKeywords,
        });
      }

      // UPDATE EXISTING PAGE
      else {
        pageEntity.page = page;

        pageEntity.metaTitle = metaTitle;

        pageEntity.metaDescription = metaDescription;

        pageEntity.metaKeywords = metaKeywords;
      }

      // SAVE PAGE
      pageEntity = await pageRepository.save(pageEntity);

      /* ================= SAVE OR UPDATE BANNER ================= */

      if (banner) {
        let bannerEntity = await bannerRepository.findOne({
          where: {
            page: {
              id: pageEntity.id,
            },
          },
          relations: ["page"],
        });

        // CREATE banner
        if (!bannerEntity) {
          bannerEntity = bannerRepository.create({
            heading: banner.heading || "",

            subHeading: banner.subHeading || "",

            page: pageEntity,
          });
        }

        // UPDATE banner
        else {
          bannerEntity.heading = banner.heading || "";

          bannerEntity.subHeading = banner.subHeading || "";
        }

        await bannerRepository.save(bannerEntity);
      }

      /* ================= DELETE OLD SECTIONS ================= */

      await sectionRepository.delete({
        page: {
          id: pageEntity.id,
        },
      });

      /* ================= INSERT NEW SECTIONS ================= */

      const sectionEntities = sections.map((section: any, index: number) =>
        sectionRepository.create({
          page: pageEntity,

          template: section.template,

          data: section.data,

          order: index,
        }),
      );

      await sectionRepository.save(sectionEntities);

      /* ================= RETURN RESULT ================= */

      return {
        id: pageEntity.id,
        page: pageEntity.page,
        sectionsCount: sectionEntities.length,
      };
    });

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,

      message: id ? "Page updated successfully" : "Page created successfully",

      pageId: result.id,

      page: result.page,

      sectionsCount: result.sectionsCount,
    });
  } catch (error: any) {
    console.error("CMS Save Error:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to save page",

      error: error.message,
    });
  }
};
