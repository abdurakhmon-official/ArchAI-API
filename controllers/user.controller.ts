import { Controller, Inject } from '@tsed/di';
import { BodyParams, PathParams, QueryParams } from '@tsed/platform-params';
import { Delete, Get, Post, Put } from '@tsed/schema';
import { AdminOnly, Authorized } from '@/middlewares/auth.middleware';
import { UserService } from '@/services/user.service';
import { CreateUserInput, UpdateUserRoleInput } from '@/inputs/user.input';
import { BasicSearch } from '@/inputs';

@Controller('/users')
export class UserController {
  @Inject()
  private userService!: UserService;

  @Get('/paginated')
  @Authorized(AdminOnly())
  async pagination(@QueryParams() query: BasicSearch) {
    return await this.userService.pagination(query);
  }

  @Post('')
  @Authorized(AdminOnly())
  async create(@BodyParams() data: CreateUserInput) {
    return await this.userService.create(data);
  }

  @Put('/:id/role')
  @Authorized(AdminOnly())
  async updateRole(@PathParams('id') id: string, @BodyParams() data: UpdateUserRoleInput) {
    return await this.userService.updateRole(id, data);
  }

  @Delete('/:id')
  @Authorized(AdminOnly())
  async delete(@PathParams('id') id: string) {
    return await this.userService.delete(id);
  }
}
