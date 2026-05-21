import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const count = await db.adminCategory.count();
    if (count === 0) {
      const defaultCategories = [
        { name: "Plumbing", description: "Water pipe leaks, clog, toilet, tap issues" },
        { name: "WiFi", description: "Internet connection and wifi issues" },
        { name: "Electrical", description: "Power outage, lights, fans, plug point issues" },
        { name: "Furniture", description: "Bed, study table, chair, wardrobe, door lock issues" },
        { name: "Water", description: "Water supply disruption, low pressure, dirty water" },
        { name: "Noise", description: "Noise disturbance, loud music, late night nuisance" },
        { name: "Security", description: "Security patrol, lock issues, suspicious activities" },
        { name: "Others", description: "Other general residential complaints" }
      ];
      await db.adminCategory.createMany({
        data: defaultCategories,
      });
    }

    const categories = await db.adminCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Failed to fetch active categories", error);
    return NextResponse.json({ message: "Failed to fetch active categories", categories: [] }, { status: 500 });
  }
}
