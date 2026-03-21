use defi10_core::{DeFi10Error, Result};
use mongodb::{
    bson::{doc, Document},
    options::ClientOptions,
    Client, Collection, Database,
};
use serde::{de::DeserializeOwned, Serialize};
use std::sync::Arc;

#[derive(Clone)]
pub struct MongoDatabase {
    client: Client,
    database: Database,
}

impl MongoDatabase {
    pub async fn new(uri: &str, database_name: &str) -> Result<Self> {
        let client_options = ClientOptions::parse(uri)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to parse MongoDB URI: {}", e)))?;

        let client = Client::with_options(client_options).map_err(|e| {
            DeFi10Error::Database(format!("Failed to create MongoDB client: {}", e))
        })?;

        // Test connection
        client
            .list_database_names()
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to connect to MongoDB: {}", e)))?;

        let database = client.database(database_name);

        Ok(Self { client, database })
    }

    pub fn collection<T: Send + Sync>(&self, name: &str) -> Collection<T> {
        self.database.collection(name)
    }

    pub fn client(&self) -> &Client {
        &self.client
    }

    pub fn database(&self) -> &Database {
        &self.database
    }

    pub async fn health_check(&self) -> Result<()> {
        self.database
            .run_command(doc! { "ping": 1 })
            .await
            .map_err(|e| DeFi10Error::Database(format!("Health check failed: {}", e)))?;
        Ok(())
    }
}

pub struct MongoRepository<T: Send + Sync> {
    collection: Collection<T>,
}

impl<T> MongoRepository<T>
where
    T: Serialize + DeserializeOwned + Unpin + Send + Sync,
{
    pub fn new(db: &MongoDatabase, collection_name: &str) -> Self {
        Self {
            collection: db.collection(collection_name),
        }
    }

    pub async fn find_one(&self, filter: Document) -> Result<Option<T>> {
        self.collection
            .find_one(filter)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Find one failed: {}", e)))
    }

    pub async fn find_many(&self, filter: Document) -> Result<Vec<T>> {
        use futures_util::stream::TryStreamExt;

        let cursor = self
            .collection
            .find(filter)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Find many failed: {}", e)))?;

        cursor
            .try_collect::<Vec<T>>()
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to collect results: {}", e)))
    }

    pub async fn insert_one(&self, document: &T) -> Result<String> {
        let result = self
            .collection
            .insert_one(document)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Insert failed: {}", e)))?;

        Ok(result.inserted_id.to_string())
    }

    pub async fn update_one(&self, filter: Document, update: Document) -> Result<bool> {
        let result = self
            .collection
            .update_one(filter, update)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Update failed: {}", e)))?;

        Ok(result.modified_count > 0)
    }

    pub async fn delete_one(&self, filter: Document) -> Result<bool> {
        let result = self
            .collection
            .delete_one(filter)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Delete failed: {}", e)))?;

        Ok(result.deleted_count > 0)
    }

    pub async fn count(&self, filter: Document) -> Result<u64> {
        self.collection
            .count_documents(filter)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Count failed: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};
    use testcontainers::{runners::AsyncRunner, ImageExt};
    use testcontainers_modules::mongo::Mongo;

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct TestDocument {
        name: String,
        value: i32,
    }

    #[tokio::test]
    #[ignore]
    async fn test_mongodb_connection() {
        let container = Mongo::default()
            .with_tag("7.0")
            .start()
            .await
            .expect("Failed to start MongoDB container");

        let port = container
            .get_host_port_ipv4(27017)
            .await
            .expect("Failed to get MongoDB port");

        let uri = format!("mongodb://localhost:{}", port);

        let db = MongoDatabase::new(&uri, "test_db").await;
        assert!(db.is_ok());

        let db = db.unwrap();
        assert!(db.health_check().await.is_ok());
    }

    #[tokio::test]
    #[ignore]
    async fn test_repository_insert_and_find() {
        let container = Mongo::default()
            .with_tag("7.0")
            .start()
            .await
            .expect("Failed to start MongoDB container");

        let port = container
            .get_host_port_ipv4(27017)
            .await
            .expect("Failed to get MongoDB port");

        let uri = format!("mongodb://localhost:{}", port);
        let db = MongoDatabase::new(&uri, "test_db").await.unwrap();

        let repo = MongoRepository::<TestDocument>::new(&db, "test_collection");

        let doc = TestDocument {
            name: "test".to_string(),
            value: 42,
        };

        // Insert
        let id = repo.insert_one(&doc).await;
        assert!(id.is_ok());

        // Find
        let found = repo.find_one(doc! { "name": "test" }).await.unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().value, 42);
    }

    #[tokio::test]
    #[ignore]
    async fn test_repository_update() {
        let container = Mongo::default()
            .with_tag("7.0")
            .start()
            .await
            .expect("Failed to start MongoDB container");

        let port = container
            .get_host_port_ipv4(27017)
            .await
            .expect("Failed to get MongoDB port");

        let uri = format!("mongodb://localhost:{}", port);
        let db = MongoDatabase::new(&uri, "test_db").await.unwrap();

        let repo = MongoRepository::<TestDocument>::new(&db, "test_collection");

        let doc = TestDocument {
            name: "update_test".to_string(),
            value: 10,
        };

        repo.insert_one(&doc).await.unwrap();

        let updated = repo
            .update_one(
                doc! { "name": "update_test" },
                doc! { "$set": { "value": 20 } },
            )
            .await
            .unwrap();

        assert!(updated);

        let found = repo
            .find_one(doc! { "name": "update_test" })
            .await
            .unwrap()
            .unwrap();

        assert_eq!(found.value, 20);
    }

    #[tokio::test]
    #[ignore]
    async fn test_repository_delete() {
        let container = Mongo::default()
            .with_tag("7.0")
            .start()
            .await
            .expect("Failed to start MongoDB container");

        let port = container
            .get_host_port_ipv4(27017)
            .await
            .expect("Failed to get MongoDB port");

        let uri = format!("mongodb://localhost:{}", port);
        let db = MongoDatabase::new(&uri, "test_db").await.unwrap();

        let repo = MongoRepository::<TestDocument>::new(&db, "test_collection");

        let doc = TestDocument {
            name: "delete_test".to_string(),
            value: 30,
        };

        repo.insert_one(&doc).await.unwrap();

        let deleted = repo
            .delete_one(doc! { "name": "delete_test" })
            .await
            .unwrap();

        assert!(deleted);

        let found = repo.find_one(doc! { "name": "delete_test" }).await.unwrap();

        assert!(found.is_none());
    }

    #[tokio::test]
    #[ignore]
    async fn test_repository_count() {
        let container = Mongo::default()
            .with_tag("7.0")
            .start()
            .await
            .expect("Failed to start MongoDB container");

        let port = container
            .get_host_port_ipv4(27017)
            .await
            .expect("Failed to get MongoDB port");

        let uri = format!("mongodb://localhost:{}", port);
        let db = MongoDatabase::new(&uri, "test_db").await.unwrap();

        let repo = MongoRepository::<TestDocument>::new(&db, "test_collection");

        for i in 0..5 {
            let doc = TestDocument {
                name: format!("count_test_{}", i),
                value: i,
            };
            repo.insert_one(&doc).await.unwrap();
        }

        let count = repo.count(doc! {}).await.unwrap();
        assert_eq!(count, 5);
    }
}
