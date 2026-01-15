import bcrypt from "bcryptjs"
export const isValid = async (password: string, userPassword: string) => {
    return bcrypt.compare(password, userPassword);
}