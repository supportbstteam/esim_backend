import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Blog } from "../../entity/Blogs.entity";

export const createBlog = async (req: Request, res: Response) => {
    try {
        const blogRepo = AppDataSource.getRepository(Blog);

        const { title, content, category, coverImage, published, summary } = req.body;

        // console.log("----- summary ----", summary)

        if (!title) {
            return res.status(400).json({ message: "Title and content are required" });
        }

        const newBlog = blogRepo.create({
            title,
            content, // HTML string contetn
            category: category,
            coverImage: coverImage,
            isActive: published,
            summary:summary,
        });

        await blogRepo.save(newBlog);

        return res.status(201).json({ message: "Blog created successfully", blog: newBlog });
    } catch (err: any) {
        console.error("Error creating blog:", err);
        return res.status(500).json({ message: "Failed to create blog", error: err.message });
    }
};

export const getAllBlogs = async (req: Request, res: Response) => {
    try {
        const blogRepo = AppDataSource.getRepository(Blog);
        const blogs = await blogRepo.find({
            order: { createdAt: "DESC" },
        });

        // ✅ Proper mapping syntax
        const bloggings = blogs.map((item) => ({
            ...item,
            published: item.isActive,
        }));

        // ✅ Return transformed array
        return res.status(200).json({ blogs: bloggings });
    } catch (err: any) {
        console.error("Error fetching blogs:", err);
        return res.status(500).json({ message: "Failed to fetch blogs" });
    }
};

export const getBlogById = async (req: Request, res: Response) => {
    try {
        const blogRepo = AppDataSource.getRepository(Blog);
        const { id } = req.params;

        const blog = await blogRepo.findOne({ where: { id } });
        if (!blog) return res.status(404).json({ message: "Blog not found" });

        // ✅ Transform field
        const transformedBlog = {
            ...blog,
            published: blog.isActive,
        };

        return res.status(200).json({ blog: transformedBlog });
    } catch (err: any) {
        console.error("Error fetching blog:", err);
        return res.status(500).json({ message: "Failed to fetch blog" });
    }
};

export const updateBlog = async (req: Request, res: Response) => {
    try {
        const blogRepo = AppDataSource.getRepository(Blog);
        const { id } = req.params;
        const updates = req.body;

        const blog = await blogRepo.findOne({ where: { id } });
        if (!blog) return res.status(404).json({ message: "Blog not found" });

        Object.assign(blog, updates);
        await blogRepo.save(blog);

        return res.status(200).json({ message: "Blog updated successfully", blog });
    } catch (err: any) {
        console.error("Error updating blog:", err);
        return res.status(500).json({ message: "Failed to update blog" });
    }
};

export const deleteBlog = async (req: Request, res: Response) => {
    try {
        const blogRepo = AppDataSource.getRepository(Blog);
        const { id } = req.params;

        const blog = await blogRepo.findOne({ where: { id } });
        if (!blog) return res.status(404).json({ message: "Blog not found" });

        await blogRepo.remove(blog);
        return res.status(200).json({ message: "Blog deleted successfully" });
    } catch (err: any) {
        console.error("Error deleting blog:", err);
        return res.status(500).json({ message: "Failed to delete blog" });
    }
};
