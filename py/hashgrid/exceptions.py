"""Custom exceptions for the Hashgrid client."""


class HashgridError(Exception):
    """Base exception for all Hashgrid errors."""
    pass


class HashgridAPIError(HashgridError):
    """Exception raised for API errors."""
    
    def __init__(self, message, status_code=None, response=None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class HashgridAuthenticationError(HashgridAPIError):
    """Exception raised for authentication errors."""
    pass


class HashgridNotFoundError(HashgridAPIError):
    """Exception raised when a resource is not found."""
    pass


class HashgridValidationError(HashgridAPIError):
    """Exception raised for validation errors."""
    pass

