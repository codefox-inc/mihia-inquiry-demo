import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("thanks", "routes/thanks.tsx"),
	route("admin", "routes/admin.tsx"),
] satisfies RouteConfig;
