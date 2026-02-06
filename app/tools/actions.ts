"use server";

export async function getReplicateAccount() {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return null;

    try {
        const response = await fetch("https://api.replicate.com/v1/account", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            // If account endpoint fails (common with some token types), try verifying with a model list
            // This at least confirms the token is valid
            if (response.status === 401) return { error: "Invalid Token" };
            return { error: "Unknown Status" };
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch Replicate account:", error);
        return null;
    }
}
