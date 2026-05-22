import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("thanks", "routes/thanks.tsx"),
	route("admin", "routes/admin.tsx"),
	route("admin/:id", "routes/admin-detail.tsx"),
] satisfies RouteConfig;
