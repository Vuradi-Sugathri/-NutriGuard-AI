import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_base64, action, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let messages: any[];

    if (action === "identify") {
      const validLabels = [
        "aloo_gobi", "aloo_matar", "aloo_methi", "aloo_shimla_mirch", "aloo_tikki",
        "bhatura", "bhindi", "biryani", "boondi", "butter_chicken", "chapati",
        "chicken_tikka_masala", "chikki", "chole", "daal_puri", "dahi_vada", "dal_makhani", "dal_tadka",
        "dhokla", "dum_aloo", "gajar_ka_halwa", "gulab_jamun", "idli", "kachori", "kadai_paneer",
        "kadhi_pakoda", "karela_bharta", "kofta", "lassi", "makki_di_roti_sarson_da_saag",
        "malapua", "mango_pickle", "masala_dosa", "masala_vada", "medu_vada", "misti_doi", "naan", "palak_paneer",
        "paneer_butter_masala", "pav_bhaji", "phirni", "poha", "rabri", "rajma", "rasgulla", "rasmalai",
        "samosa", "sandwich", "semolina_kheer", "shrikhand", "sohan_papdi", "upma", "uttapam", "vada"
      ];
      const labelList = validLabels.map(l => l.replace(/_/g, " ")).join(", ");

      messages = [
        {
          role: "system",
          content: `You are a food identification expert specializing in Indian cuisine. Given an image of a dish, identify it and return ONLY valid JSON with this exact structure:
{"dish_name": "label", "ingredients": ["ingredient1", "ingredient2", ...], "alternatives": ["similar dish 1", "similar dish 2", "similar dish 3"]}

CRITICAL RULES:
1. The dish_name MUST be one of these valid labels: ${labelList}
2. Use the underscore format for dish_name (e.g. "medu_vada", "butter_chicken").
3. The alternatives should be 3 dishes from the same list above.
4. Do NOT include any text outside the JSON.

SOUTH INDIAN RULES (CRITICAL):
- Fried, golden-brown doughnut/ring-shaped savory fritters with a hole in the center (or lentil fritters) → "medu_vada" or "vada". NEVER label as idli!
- Steamed white round spongy cakes → "idli".
- Thin golden fermented crepes/pancakes, rolled or folded → "masala_dosa".

BIRYANI RULES (HIGHEST PRIORITY):
- Any rice-based dish with meat/chicken/egg → "biryani" (will be mapped to mutton biryani)
- Any rice-based dish with only vegetables → "biryani" (will be mapped to vegetable biryani)
- NEVER return "pulao", "chicken biryani", "egg biryani", or any rice name not in the list.
- Do NOT confuse biryani with curry dishes, soups, or leafy dishes.

MATCHING PRIORITY:
- Choose the label that best matches the visual appearance of the dish.
- If uncertain between two labels, pick the one with higher visual similarity.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Identify this Indian dish. Return only JSON. The dish_name must be from the valid labels list." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}` } },
          ],
        },
      ];
    } else if (action === "explain") {
      messages = [
        {
          role: "system",
          content: `You are a medical nutrition advisor. Given structured risk analysis data, write a clear 2-3 paragraph explanation. Do NOT change any risk numbers. Mention the highest risk conditions first. Provide simple dietary recommendations. Be professional but accessible.`,
        },
        {
          role: "user",
          content: `Here is the analysis data:\n${JSON.stringify(context, null, 2)}\n\nWrite a 2-3 paragraph health assessment explanation based on this data. Reference specific nutrient values and condition risks.`,
        },
      ];
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: action === "identify" ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview",
        messages,
        ...(action === "identify" ? { max_tokens: 500 } : { max_tokens: 1000 }),
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    if (action === "identify") {
      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse dish identification response");
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({ explanation: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("analyze-dish error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
