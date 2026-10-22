import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UsersController } from '../../users/users.controller';
import { hasPermission } from '../../common/permissions';

// Scoped to the PostgreSQL preview; legacy deployment is not switched implicitly.
@Injectable()
export class PostgresUsersPermissionsGuard implements CanActivate {
  canActivate(context:ExecutionContext) {
    if(context.getClass()!==UsersController) return true;
    const request=context.switchToHttp().getRequest();
    const user=request.user;
    const action=context.getHandler().name;
    if(['findOne','uploadAvatar'].includes(action)&&Number(request.params.id)===user?.sub) return true;
    const permission=request.method==='GET'?'users:view':'users:edit';
    if(!hasPermission(user?.permissions??[],permission)) throw new ForbiddenException(`Se requiere el permiso: ${permission}`);
    return true;
  }
}
