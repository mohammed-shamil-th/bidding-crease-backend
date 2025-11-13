# Bulk Upload Players API

## Endpoint
`POST /api/players/bulk`

## Authentication
Requires admin authentication token in headers:
```
Authorization: Bearer <your-admin-token>
```

## Request Body
```json
{
  "tournamentId": "tournament_id_here",
  "players": [
    {
      "name": "John Doe"
    },
    {
      "name": "Jane Smith",
      "mobile": "9876543210",
      "role": "Batter",
      "category": "Icon",
      "basePrice": 5000,
      "location": "Mumbai"
    },
    {
      "name": "Bob Johnson",
      "role": "Bowler",
      "category": "Regular",
      "basePrice": 3000
    }
  ]
}
```

## Field Requirements

### Required Fields:
- `tournamentId` (string): Valid tournament ID
- `players` (array): Array of player objects
  - `name` (string): Player name (required for each player)

### Optional Fields (per player):
- `mobile` (string): 10-15 digit mobile number. If not provided, a random number will be generated
- `role` (string): "Batter", "Bowler", or "All-Rounder". Default: "Batter"
- `category` (string): "Icon" or "Regular". Default: "Regular"
- `basePrice` (number): Base price. Default: 0
- `location` (string): Player location
- `battingStyle` (string): "Right" or "Left"
- `bowlingStyle` (string): One of the valid bowling styles

## Response

### Success (201 Created)
```json
{
  "success": true,
  "message": "Bulk upload completed. Created: 3, Errors: 0",
  "data": {
    "created": 3,
    "errors": 0,
    "total": 3,
    "createdPlayers": [
      {
        "index": 0,
        "name": "John Doe",
        "id": "player_id_1"
      },
      {
        "index": 1,
        "name": "Jane Smith",
        "id": "player_id_2"
      }
    ]
  }
}
```

### With Errors
```json
{
  "success": true,
  "message": "Bulk upload completed. Created: 2, Errors: 1",
  "data": {
    "created": 2,
    "errors": 1,
    "total": 3,
    "createdPlayers": [...],
    "errors": [
      {
        "index": 2,
        "name": "",
        "error": "Name is required"
      }
    ]
  }
}
```

## Example Postman Request

1. **Method**: POST
2. **URL**: `http://localhost:5000/api/players/bulk`
3. **Headers**:
   - `Content-Type: application/json`
   - `Authorization: Bearer <your-token>`
4. **Body** (raw JSON):
```json
{
  "tournamentId": "507f1f77bcf86cd799439011",
  "players": [
    { "name": "Player One" },
    { "name": "Player Two", "role": "Bowler", "category": "Regular" },
    { "name": "Player Three", "basePrice": 10000, "category": "Icon" }
  ]
}
```

## Notes
- Player names are automatically capitalized (e.g., "john doe" becomes "John Doe")
- Images are not included in bulk upload - you can update them later using the update player endpoint
- If mobile is not provided, a random 10-digit number starting with 9 will be generated
- Invalid entries are skipped and reported in the errors array
- The endpoint processes all players even if some fail, and returns a summary

