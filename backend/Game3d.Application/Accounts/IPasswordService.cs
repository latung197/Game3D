namespace Game3d.Application.Accounts;

public interface IPasswordService
{
    string Hash(AccountRecord account, string password);
    bool Verify(AccountRecord account, string password);
}
