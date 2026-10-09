module.exports = {
  reactStrictMode: true,
  // Turbopack у pages router виносить @emotion/react із SSR-бандла, а @mui/material
  // тягне власну копію — через два екземпляри Emotion класи MUI різняться на
  // сервері й клієнті (hydration mismatch). Спільний бандл прибирає розбіжність.
  bundlePagesRouterDependencies: true,
  // next dev 16 сам створює AGENTS.md з інструкціями для агентів; правила агентів ведемо в кореневому AGENTS.md
  agentRules: false,
}
