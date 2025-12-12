import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Testimonial } from "../../entity/Testimonials.entity";
import { checkAdmin } from "../../utils/checkAdmin";

// Create a new testimonial
export const createTestimonial = async (req: any, res: Response) => {
  if (!checkAdmin(req, res)) return res.status(403).json({ message: "Unauthorized" });

  try {
    const { name, profession, content } = req.body;

    if (!name || !content) {
      return res.status(400).json({ message: "Name and content are required" });
    }

    const testimonialRepo = AppDataSource.getRepository(Testimonial);
    const newTestimonial = testimonialRepo.create({ name, profession, content });
    await testimonialRepo.save(newTestimonial);

    return res.status(201).json({
      message: "Testimonial created successfully",
      testimonial: newTestimonial,
    });
  } catch (err: any) {
    console.error("Error creating testimonial:", err);
    return res.status(500).json({ message: "Failed to create testimonial", error: err.message });
  }
};

// Get all testimonials
export const getAllTestimonials = async (_req: Request, res: Response) => {
  try {
    const testimonialRepo = AppDataSource.getRepository(Testimonial);
    const testimonials = await testimonialRepo.find({
      order: { createdAt: "DESC" },
    });
    return res.status(200).json({ testimonials });
  } catch (err: any) {
    console.error("Error fetching testimonials:", err);
    return res.status(500).json({ message: "Failed to fetch testimonials", error: err.message });
  }
};

// Get single testimonial by ID
export const getTestimonialById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const testimonialRepo = AppDataSource.getRepository(Testimonial);
    const testimonial = await testimonialRepo.findOne({ where: { id } });

    if (!testimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    return res.status(200).json({ testimonial });
  } catch (err: any) {
    console.error("Error fetching testimonial:", err);
    return res.status(500).json({ message: "Failed to fetch testimonial", error: err.message });
  }
};

// Update testimonial
export const updateTestimonial = async (req: Request, res: Response) => {
  if (!checkAdmin(req, res)) return res.status(403).json({ message: "Unauthorized" });
  try {
    const { id } = req.params;
    const { name, profession, content } = req.body;

    const testimonialRepo = AppDataSource.getRepository(Testimonial);
    const testimonial = await testimonialRepo.findOne({ where: { id } });

    if (!testimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    testimonial.name = name ?? testimonial.name;
    testimonial.profession = profession ?? testimonial.profession;
    testimonial.content = content ?? testimonial.content;

    await testimonialRepo.save(testimonial);

    return res.status(200).json({
      message: "Testimonial updated successfully",
      testimonial,
    });
  } catch (err: any) {
    console.error("Error updating testimonial:", err);
    return res.status(500).json({ message: "Failed to update testimonial", error: err.message });
  }
};

// Delete testimonial
export const deleteTestimonial = async (req: Request, res: Response) => {
  if (!checkAdmin(req, res)) return res.status(403).json({ message: "Unauthorized" });
  try {
    const { id } = req.params;
    const testimonialRepo = AppDataSource.getRepository(Testimonial);
    const testimonial = await testimonialRepo.findOne({ where: { id } });

    if (!testimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    await testimonialRepo.remove(testimonial);

    return res.status(200).json({ message: "Testimonial deleted successfully" });
  } catch (err: any) {
    console.error("Error deleting testimonial:", err);
    return res.status(500).json({ message: "Failed to delete testimonial", error: err.message });
  }
};

// Update Active/Inactive status
export const updateTestimonialStatus = async (req: Request, res: Response) => {
  if (!checkAdmin(req, res)) return res.status(403).json({ message: "Unauthorized" });

  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be a boolean" });
    }

    const testimonialRepo = AppDataSource.getRepository(Testimonial);
    const testimonial = await testimonialRepo.findOne({ where: { id } });

    if (!testimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    testimonial.isActive = isActive;
    await testimonialRepo.save(testimonial);

    return res.status(200).json({
      message: `Testimonial ${isActive ? "activated" : "deactivated"} successfully`,
      testimonial,
    });
  } catch (err: any) {
    console.error("Error updating testimonial status:", err);
    return res.status(500).json({
      message: "Failed to update testimonial status",
      error: err.message,
    });
  }
};