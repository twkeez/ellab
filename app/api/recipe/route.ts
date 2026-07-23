// Dinner-idea endpoint. Source is TheMealDB (free, no API key). Returns one
// random meal. Not cached — each call is a fresh suggestion.

export async function GET() {
  try {
    const res = await fetch("https://www.themealdb.com/api/json/v1/1/random.php", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    const meal = data?.meals?.[0];
    if (!meal) throw new Error("no meal");

    return Response.json({
      name: meal.strMeal,
      category: meal.strCategory,
      area: meal.strArea,
      source: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
    });
  } catch {
    return Response.json({ error: "recipe unavailable" }, { status: 502 });
  }
}
