# Security Specification - Grocery Flow

## Data Invariants
- A product must have a name, barcode, and positive price/stock.
- A sale must record the items sold, the total price, and the staff member who processed it.
- A user's role can only be modified by an admin.
- Tasks must be associated with a valid status.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to create a product with an `ownerId` that isn't the current user (not applicable here as products are store-wide, but relevant for roles).
2. **Privilege Escalation**: A staff member tries to update their own role to 'admin'.
3. **Ghost Update**: Update a product price to a negative value.
4. **Barcode Collision**: (Handled by app logic/indices, but rules should ensure price isn't corrupted).
5. **Sale Tampering**: A user tries to delete a sale record (only admins should be able to view/delete history if allowed, usually history is immutable).
6. **Role Hijacking**: A user tries to create a role record for another UID.
7. **Task Injection**: Creating a task assigned to a non-existent UID or using a malicious payload.
8. **Resource Poisoning**: Injecting 1MB of text into the product description.
9. **Timestamp Manipulation**: Manually setting `createdAt` to a future date instead of `request.time`.
10. **Shadow Field**: Adding `isVerified: true` to a product during creation.
11. **PII Leak**: A guest (unauthenticated) tries to list all user roles and emails.
12. **Batch Inconsistency**: Creating a sale without updating product stock (requires atomic batch, rules check `existsAfter`).

## Test Runner Logic
The `firestore.rules` will be tested to ensure these payloads are rejected.

### Helper Functions
- `isSignedIn()`: User is authenticated.
- `isAdmin()`: User role in `/roles/{uid}` is 'admin'.
- `isStaff()`: User role in `/roles/{uid}` is 'staff' or 'admin'.
- `isValidProduct(data)`: Validates Product schema.
- `isValidSale(data)`: Validates Sale schema.
