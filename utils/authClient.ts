import Cookies from "js-cookie";

export type ClientSessionUser = {
  id: string;
  name?: string;
  email: string;
  role?: string;
  lokasi?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const getSessionClient = async (): Promise<ClientSessionUser | null> => {
  try {
    const token = Cookies.get("session_id");
    if (process.env.NODE_ENV === "development") {
      console.log("Session ID from cookies:", token);
    }
    if (!token) {
      return null;
    }

    const response = await fetch("/api/auth/session", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (response.ok) {
      const user = await response.json();
      return user;
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error in getSessionClient:", error);
    }
    return null;
  }
};
