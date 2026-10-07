import * as React from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "next/link";
import { MainLayout } from "../layouts/MainLayout";

const NotFound: React.FC = () => {
  return (
    <MainLayout title="Сторінку не знайдено">
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 3,
          px: 2,
          textAlign: "center",
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: "4rem", md: "6rem" },
            fontWeight: 800,
            color: "primary.main",
            lineHeight: 1,
          }}
        >
          404
        </Typography>
        <Typography
          variant="h4"
          sx={{ fontSize: "1.25rem", color: "text.secondary" }}
        >
          Сторінку не знайдено
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", maxWidth: 360 }}
        >
          Можливо, сторінку було переміщено або видалено, чи ви вказали
          неправильну адресу.
        </Typography>
        <Link href="/" style={{ textDecoration: "none" }}>
          <Button variant="contained" sx={{ px: 5, py: 1.5 }}>
            На головну
          </Button>
        </Link>
      </Box>
    </MainLayout>
  );
};

export default NotFound;