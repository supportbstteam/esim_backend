import mongoose from "mongoose";
import { Response } from "express";
import OperatorModel from "../../../models/OperatorModel";
import { checkAdmin } from "../../../utils/checkAdmin";

// ---------------- CREATE OPERATOR ----------------
export const postAdminAddOperator = async (req: any, res: Response) => {
    const { id } = req.user;
    if (!id) return res.status(403).json({ message: "Unauthorized, Please Login" });
    if (!(await checkAdmin(req, res))) return;

    try {
        const { operators } = req.body; // expecting an array of operators
        if (!operators || !Array.isArray(operators) || operators.length === 0) {
            return res.status(400).json({ message: "Operators array is required" });
        }

        // Destructure and validate each operator
        const operatorsToSave = operators.map(op => {
            const { name, code, countries, isActive = true } = op;
            if (!name || !code || !countries || !Array.isArray(countries) || countries.length === 0) {
                throw new Error("Each operator must have name, code, and at least one country");
            }
            return { name, code, countries, isActive };
        });

        // Check for duplicate codes in DB
        const codes = operatorsToSave.map(op => op.code);
        const existing = await OperatorModel.find({ code: { $in: codes }, isDelete: false });

        if (existing.length > 0) {
            return res.status(400).json({
                message: `Operators with codes already exist: ${existing.map(op => op.code).join(", ")}`,
            });
        }

        // Insert multiple operators
        const newOperators = await OperatorModel.insertMany(operatorsToSave);
        return res.status(201).json({ message: "Operators created successfully", operators: newOperators });
    } catch (err: any) {
        return res.status(500).json({ message: err.message });
    }
};

// ---------------- GET ALL OPERATORS ----------------
export const getAdminOperators = async (req: any, res: Response) => {
    const { id } = req.user;
    if (!id) return res.status(403).json({ message: "Unauthorized, Please Login" });
    if (!(await checkAdmin(req, res))) return;

    try {
        const { name, code, country, isActive, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = req.query;

        // Build dynamic filter, exclude soft-deleted
        const filter: any = { isDelete: false };

        if (name) filter.name = { $regex: name, $options: "i" };
        if (code) filter.code = code;
        if (country) filter.countries = country;
        if (isActive !== undefined) filter.isActive = isActive === "true";

        // Pagination
        const pageNumber = parseInt(page as string, 10) || 1;
        const pageSize = parseInt(limit as string, 10) || 10;
        const skip = (pageNumber - 1) * pageSize;

        // Sorting
        const sort: any = {};
        sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

        // Query DB
        const [operators, total] = await Promise.all([
            OperatorModel.find(filter)
                .populate("countries")
                .sort(sort)
                .skip(skip)
                .limit(pageSize),
            OperatorModel.countDocuments(filter),
        ]);

        return res.status(200).json({
            total,
            page: pageNumber,
            pages: Math.ceil(total / pageSize),
            operators,
        });
    } catch (err: any) {
        return res.status(500).json({ message: err.message });
    }
};

// ---------------- GET SINGLE OPERATOR ----------------
export const getAdminOperatorById = async (req: any, res: Response) => {
    const { id } = req.user;
    if (!id) return res.status(403).json({ message: "Unauthorized, Please Login" });
    if (!(await checkAdmin(req, res))) return;

    try {
        const { operatorId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(operatorId)) {
            return res.status(400).json({ message: "Invalid Operator ID" });
        }

        const operator = await OperatorModel.findOne({ _id: operatorId, isDelete: false }).populate("countries");
        if (!operator) return res.status(404).json({ message: "Operator not found" });

        return res.status(200).json({ operator });
    } catch (err: any) {
        return res.status(500).json({ message: err.message });
    }
};

// ---------------- UPDATE OPERATOR ----------------
export const putAdminUpdateOperator = async (req: any, res: Response) => {
    const { id } = req.user;
    if (!id) return res.status(403).json({ message: "Unauthorized, Please Login" });
    if (!(await checkAdmin(req, res))) return;

    try {
        const { operatorId } = req.params;
        const { name, code, countries, isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(operatorId)) {
            return res.status(400).json({ message: "Invalid Operator ID" });
        }

        const operator = await OperatorModel.findOneAndUpdate(
            { _id: operatorId, isDelete: false },
            { name, code, countries, isActive },
            { new: true, runValidators: true }
        ).populate("countries");

        if (!operator) return res.status(404).json({ message: "Operator not found or deleted" });

        return res.status(200).json({ message: "Operator updated successfully", operator });
    } catch (err: any) {
        return res.status(500).json({ message: err.message });
    }
};

// ---------------- SOFT DELETE OPERATOR ----------------
export const deleteAdminOperator = async (req: any, res: Response) => {
    const { id } = req.user;
    if (!id) return res.status(403).json({ message: "Unauthorized, Please Login" });
    if (!(await checkAdmin(req, res))) return;

    try {
        const { operatorId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(operatorId)) {
            return res.status(400).json({ message: "Invalid Operator ID" });
        }

        const operator = await OperatorModel.findOneAndUpdate(
            { _id: operatorId, isDelete: false },
            { isDelete: true, isActive: false },
            { new: true }
        );

        if (!operator) return res.status(404).json({ message: "Operator not found or already deleted" });

        return res.status(200).json({ message: "Operator soft deleted successfully", operator });
    } catch (err: any) {
        return res.status(500).json({ message: err.message });
    }
};
