import { Langfuse } from "langfuse";

export const langfuse =
    process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY
        ? new Langfuse({
            secretKey: process.env.LANGFUSE_SECRET_KEY,
            publicKey: process.env.LANGFUSE_PUBLIC_KEY,
            baseUrl: process.env.LANGFUSE_BASEURL,
        })
        : null;

export function startTrace(name: string, input?: unknown) {
    try {
        return langfuse?.trace({ name, input, tags: ["iris-chat-to-chart"] }) ?? null;
    } catch {
        return null;
    }
}


