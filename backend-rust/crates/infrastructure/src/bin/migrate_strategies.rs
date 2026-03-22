use clap::Parser;
use defi10_infrastructure::database::{MongoDatabase, StrategyMigrator};
use std::process;

#[derive(Parser)]
#[command(name = "strategy-migration")]
#[command(about = "Migrates MongoDB strategy item fields from PascalCase to camelCase")]
struct Args {
    /// MongoDB connection URI
    #[arg(
        short,
        long,
        default_value = "mongodb://localhost:27017",
        help = "MongoDB connection URI"
    )]
    uri: String,

    /// Database name
    #[arg(short, long, default_value = "defi10", help = "MongoDB database name")]
    database: String,

    /// Collection name
    #[arg(
        short,
        long,
        default_value = "strategies",
        help = "Collection name to migrate"
    )]
    collection: String,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();

    println!("==============================================");
    println!("  DEFI10 RUST - STRATEGY MIGRATION");
    println!("==============================================");
    println!();
    println!("Connection: {}", args.uri);
    println!("Database: {}", args.database);
    println!("Collection: {}", args.collection);
    println!();

    // Initialize logging
    tracing_subscriber::fmt::init();

    // Connect to MongoDB
    let mongo_db = match MongoDatabase::new(&args.uri, &args.database).await {
        Ok(db) => {
            println!("✓ Connected to MongoDB successfully");
            db
        }
        Err(e) => {
            eprintln!("✗ Failed to connect to MongoDB: {}", e);
            process::exit(1);
        }
    };

    // Perform migration
    let migrator = StrategyMigrator::new(mongo_db.database());

    match migrator.migrate_strategy_fields().await {
        Ok((migrated, errors)) => {
            if errors > 0 {
                println!("⚠ Migration completed with {} errors", errors);
                process::exit(1);
            } else {
                println!(
                    "✓ Migration completed successfully! Migrated {} documents",
                    migrated
                );
                process::exit(0);
            }
        }
        Err(e) => {
            eprintln!("✗ Migration failed: {}", e);
            process::exit(1);
        }
    }
}
