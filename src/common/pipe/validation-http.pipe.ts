import {
    Injectable,
    PipeTransform,
    ArgumentMetadata,
    BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ValidationHttpPipe implements PipeTransform<any> {
    async transform(value: any, { metatype }: ArgumentMetadata) {
        if (!metatype || !this.toValidate(metatype)) {
            return value;
        }

        const entity = plainToClass(metatype, value);
        const errors = await validate(entity);

        if (errors.length > 0) {
            throw new BadRequestException(
                `Arguments invalid (${errors
                    .map((err) => err.property)
                    .join()}): ${this.formatErrors(errors)}`,
            );
        }
        return entity || value;
    }

    private toValidate(metatype: any): boolean {
        const types: any[] = [String, Boolean, Number, Array, Object];
        return !types.includes(metatype);
    }

    private formatErrors(errors: any[]) {
        return errors
            .map((err) => {
                for (const property in err.constraints) {
                    return err.constraints[property];
                }
            })
            .join(', ');
    }
}
