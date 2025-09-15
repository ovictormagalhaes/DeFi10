# Use the official .NET 9 runtime as a parent image
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080

# Use the SDK image to build the application
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy csproj and restore as distinct layers
COPY ["backend/MyWebWallet.API/MyWebWallet.API.csproj", "MyWebWallet.API/"]
RUN dotnet restore "MyWebWallet.API/MyWebWallet.API.csproj"

# Copy everything else and build
COPY backend/MyWebWallet.API/ MyWebWallet.API/
WORKDIR "/src/MyWebWallet.API"
RUN dotnet build "MyWebWallet.API.csproj" -c Release -o /app/build

# Publish the application
FROM build AS publish
RUN dotnet publish "MyWebWallet.API.csproj" -c Release -o /app/publish --no-restore

# Final stage/image
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Create a non-privileged user that the app will run under
RUN adduser --disabled-password --gecos '' appuser && chown -R appuser /app
USER appuser

ENTRYPOINT ["dotnet", "MyWebWallet.API.dll"]