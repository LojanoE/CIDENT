import { Outlet, createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/layout";
import { AtencionFormPage } from "../features/atenciones/AtencionFormPage";
import { AtencionLayout } from "../features/atenciones/AtencionLayout";
import { AtencionesListPage } from "../features/atenciones/AtencionesListPage";
import { LoginPage } from "../features/auth/LoginPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { NuevoPacientePage } from "../features/pacientes/NuevoPacientePage";
import { PacienteDetailPage } from "../features/pacientes/PacienteDetailPage";
import { PacienteLayout } from "../features/pacientes/PacienteLayout";
import { PacientesListPage } from "../features/pacientes/PacientesListPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { NoEncontrada, RutaError } from "./RutaError";

/**
 * Jerarquía de rutas: el marco (`AppShell`) y la sesión se resuelven una sola vez en `/`.
 * Las pantallas pesadas (odontograma, administración) se cargan bajo demanda con `lazy`.
 */
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    errorElement: <RutaError />,
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: "pacientes",
        children: [
          { index: true, element: <PacientesListPage /> },
          { path: "nuevo", element: <NuevoPacientePage /> },
          {
            path: ":patientId",
            element: <PacienteLayout />,
            children: [
              { index: true, element: <PacienteDetailPage /> },
              {
                path: "pagos",
                lazy: async () => ({
                  Component: (await import("../features/pagos/PagosPacientePage")).PagosPacientePage,
                }),
              },
              {
                path: "atenciones",
                children: [
                  { index: true, element: <AtencionesListPage /> },
                  { path: "nueva", element: <AtencionFormPage /> },
                  {
                    path: ":visitId",
                    element: <AtencionLayout />,
                    children: [
                      { index: true, element: <AtencionFormPage /> },
                      {
                        path: "odontograma",
                        lazy: async () => ({
                          Component: (await import("../features/odontograma/OdontogramaPage")).OdontogramaPage,
                        }),
                      },
                      {
                        path: "documentos",
                        lazy: async () => ({
                          Component: (await import("../features/documentos/DocumentosPanel")).DocumentosPanel,
                        }),
                      },
                      {
                        path: "adjuntos",
                        lazy: async () => ({
                          Component: (await import("../features/adjuntos/AdjuntosPanel")).AdjuntosPanel,
                        }),
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        path: "agenda",
        lazy: async () => ({
          Component: (await import("../features/agenda/AgendaPage")).AgendaPage,
        }),
      },
      {
        path: "contabilidad",
        lazy: async () => ({
          Component: (await import("../features/contabilidad/ContabilidadPage")).ContabilidadPage,
        }),
      },
      {
        path: "admin",
        element: (
          <ProtectedRoute rolRequerido="admin">
            <Outlet />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import("../features/admin/AdminUsersPage")).AdminUsersPage,
            }),
          },
          {
            path: "centros",
            lazy: async () => ({
              Component: (await import("../features/admin/AdminCentrosPage")).AdminCentrosPage,
            }),
          },
        ],
      },
      { path: "*", element: <NoEncontrada /> },
    ],
  },
]);
