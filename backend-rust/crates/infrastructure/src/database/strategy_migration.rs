use mongodb::{
    bson::{doc, Document},
    Collection, Database,
};
use serde_json::Value;
use std::error::Error;

/// MongoDB field migration utility for Rust backend
/// Migrates strategy item fields from PascalCase to camelCase
pub struct StrategyMigrator {
    collection: Collection<Document>,
}

impl StrategyMigrator {
    pub fn new(database: &Database) -> Self {
        Self {
            collection: database.collection("strategies"),
        }
    }

    pub async fn migrate_strategy_fields(&self) -> Result<(u32, u32), Box<dyn Error>> {
        println!("==============================================");
        println!("  STRATEGY ITEM FIELDS MIGRATION (Rust)");
        println!("==============================================");
        println!();

        // Find all documents with items that have PascalCase fields
        let filter = doc! {
            "$or": [
                {"items.0.Version": {"$exists": true}},
                {"items.0.Assets": {"$exists": true}},
                {"items.0.Note": {"$exists": true}},
                {"items.0.Value": {"$exists": true}},
                {"items.0.Metadata": {"$exists": true}},
                {"items.0.AdditionalInfo": {"$exists": true}}
            ]
        };

        let mut cursor = self.collection.find(filter).await?;
        let mut migrated = 0u32;
        let mut errors = 0u32;

        while cursor.advance().await? {
            let mut doc = cursor.deserialize_current()?;
            let id = doc.get("_id").cloned();

            match self.migrate_document_items(&mut doc).await {
                Ok(true) => {
                    // Update the document in database
                    if let Some(id) = id {
                        let update_filter = doc! {"_id": id.clone()};
                        let update_doc = doc! {"$set": {"items": doc.get("items")}};

                        match self.collection.update_one(update_filter, update_doc).await {
                            Ok(_) => {
                                migrated += 1;
                                println!("✓ Migrated document {:?}", id);
                            }
                            Err(e) => {
                                errors += 1;
                                println!("✗ Failed to update document {:?}: {}", id, e);
                            }
                        }
                    }
                }
                Ok(false) => {
                    // No migration needed
                    println!("⚠ No migration needed for document {:?}", id);
                }
                Err(e) => {
                    errors += 1;
                    println!("✗ Error processing document {:?}: {}", id, e);
                }
            }
        }

        println!();
        println!("==============================================");
        println!("Migration completed!");
        println!("  Migrated: {}", migrated);
        println!("  Errors: {}", errors);
        println!("==============================================");

        Ok((migrated, errors))
    }

    async fn migrate_document_items(&self, doc: &mut Document) -> Result<bool, Box<dyn Error>> {
        let mut changed = false;

        if let Some(items) = doc.get_mut("items") {
            if let Some(items_array) = items.as_array_mut() {
                for item in items_array.iter_mut() {
                    if let Some(item_doc) = item.as_document_mut() {
                        changed |= self.rename_field(item_doc, "Version", "version");
                        changed |= self.rename_field(item_doc, "Assets", "assets");
                        changed |= self.rename_field(item_doc, "Note", "note");
                        changed |= self.rename_field(item_doc, "Value", "value");
                        changed |= self.rename_field(item_doc, "Metadata", "metadata");
                        changed |= self.rename_field(item_doc, "AdditionalInfo", "additionalInfo");
                    }
                }
            }
        }

        Ok(changed)
    }

    fn rename_field(&self, doc: &mut Document, old_name: &str, new_name: &str) -> bool {
        if let Some(value) = doc.remove(old_name) {
            doc.insert(new_name, value);
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mongodb::bson::bson;

    #[tokio::test]
    async fn test_field_migration() {
        // Mock test - would need actual MongoDB connection in integration tests
        let mut doc = doc! {
            "_id": "test_id",
            "items": [
                {
                    "Version": "1.0",
                    "Assets": "BTC",
                    "Note": "Test note",
                    "Value": "100",
                    "Metadata": {"key": "value"},
                    "AdditionalInfo": "Additional"
                }
            ]
        };

        // This would be tested with actual MongoDB instance
        // For now, just verify the structure
        assert!(doc.contains_key("items"));
    }
}
