// Re-export all schemas from a single entry point
export * from "./coordinates.schema";
export * from "./geojson.schema";
export * from "./address.schema";
export * from "./timespan.schema";
export * from "./pin.schema";
export * from "./street-section.schema";
export * from "./extracted-data.schema";
export * from "./message.schema";
export * from "./message-snapshot.schema";
export * from "./notification-history.schema";
export * from "./source.schema";
export * from "./notification-subscription.schema";

// Re-export the zod instance
export { z } from "zod";
