# 🥗 NutriGuard AI

> **Indian Dish Recognition & Health Risk Assessment System with Intelligent Diet Planning**

NutriGuard AI is an Explainable AI (XAI) web application that identifies Indian dishes from photos, analyzes their nutritional breakdown against the ICMR-NIN dataset (1,014 dishes), evaluates health risks for chronic conditions, and generates personalized diet plans.

---

## ✨ Key Features

- **🍛 Dish Recognition**: Identifies Indian food using Gemini Vision AI with South Indian disambiguation (e.g. Vada vs. Idli) and human-in-the-loop manual selection.
- **📊 1,014-Dish Nutritional Dataset**: Complete macro & micronutrient profiling (calories, protein, carbs, fat, glycemic load, sodium, iron, calcium, fiber).
- **🩺 Multi-Condition Health Risk Engine**: Evaluates risk scores (0–10) for Type 2 Diabetes, Hypertension, and Obesity.
- **🥗 Personalized Diet Planning**: Calorie deficit calculations (Mifflin–St Jeor BMR & TDEE) with meal generation and PDF export.
- **📈 6–8 Week Weight Projections**: Clear before-vs-after risk comparisons and projected health metrics.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Shadcn UI
- **AI & Analysis**: Google Gemini API, TF-IDF / Cosine Similarity Matching
- **Dataset**: ICMR-NIN Indian Food Composition Tables (1,014 items)

---

## 🚀 Quick Start

```bash
# 1. Clone repository
git clone https://github.com/Vuradi-Sugathri/-NutriGuard-AI.git

# 2. Open project folder
cd -NutriGuard-AI

# 3. Install dependencies
npm install

# 4. Start local development server
npm run dev
```

Open `http://localhost:8080` (or `http://localhost:8081`) in your browser.

---

## ⚠️ Academic Disclaimer

Developed as an academic major project. All risk scores and dietary recommendations are based on standard nutritional formulas (ICMR-NIN guidelines) for educational demonstration and do not replace professional medical advice.