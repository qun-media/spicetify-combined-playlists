export function addIdFromUri<T extends { uri: string }>(item: T): T & { id: string } {
   const uri = Spicetify.URI.from(item.uri);
   if (!uri?.id) {
      console.error(`Could not extract ID from URI: ${item.uri}`);
      return item as T & { id: string }; // Return the original item without an ID, but still satisfy the type requirement
   }
   return { ...item, id: uri.id };
}
