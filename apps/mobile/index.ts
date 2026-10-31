// zod's config must be set before any schema module loads, so it is imported first and the router last.
import './src/lib/zod-jitless';
import 'expo-router/entry';
