import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Contact } from "../entity/ContactUs.entity";

const contactRepo = AppDataSource.getRepository(Contact);

// ✅ Get all contacts
export const getContacts = async (_req: Request, res: Response) => {
  try {
    const contacts = await contactRepo.find();
    return res.json(contacts);
  } catch (err) {
    return res.status(500).json({ message: "Error fetching contacts", error: err });
  }
};

export const createContacts = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    const contacts = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ message: "Contacts array is required" });
    }

    await queryRunner.startTransaction();

    const newContacts = queryRunner.manager.create(Contact, contacts);
    const savedContacts = await queryRunner.manager.save(Contact, newContacts);

    await queryRunner.commitTransaction();

    return res.status(201).json(savedContacts);
  } catch (err: any) {
    console.error("❌ Error creating contacts:", err);

    await queryRunner.rollbackTransaction();

    // Handle DB connection or query failures
    if (err?.code === "ECONNRESET") {
      return res.status(503).json({
        message: "Database connection was lost while saving contacts. Please try again.",
        error: err,
      });
    }

    return res.status(500).json({
      message: "Error creating contacts",
      error: err?.message || err,
    });
  } finally {
    await queryRunner.release();
  }
};

// ✅ Update a single contact
export const updateContact = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const contact = await contactRepo.findOneBy({ id });
    if (!contact) return res.status(404).json({ message: "Contact not found" });

    contactRepo.merge(contact, updates);
    const saved = await contactRepo.save(contact);

    return res.json(saved);
  } catch (err) {
    return res.status(500).json({ message: "Error updating contact", error: err });
  }
};

// ✅ Delete a contact
export const deleteContact = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contact = await contactRepo.findOneBy({ id });
    if (!contact) return res.status(404).json({ message: "Contact not found" });

    await contactRepo.remove(contact);
    return res.json({ message: "Contact deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Error deleting contact", error: err });
  }
};
