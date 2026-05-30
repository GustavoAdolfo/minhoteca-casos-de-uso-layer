import {
  AutorDTO,
  AutorAdapter,
  UseCaseInterface,
  PageDataType,
  LogService,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class CriarAutorUseCase implements UseCaseInterface {
  private _tabelaAutores: string;
  private logService = new LogService('CriarAutorUseCase');

  constructor(private _repository: RepositoryInterface) {
    this._tabelaAutores = process.env.TABELA_AUTORES || 'Autores';
    this.logService.info('🏁 Iniciando caso de uso de criar autor.');
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    try {
      const body = JSON.parse(data.body ?? '{}');
      this.logService.info('Dados recebidos para gravação', {}, { body });

      const entity = AutorAdapter.fromCreateDTO(body);
      this.logService.info('Dados convertidos para entidade', { entity });

      await this._repository.saveData(this._tabelaAutores, JSON.parse(entity.toJSONString()));
      this.logService.info('Autor gravado com sucesso', { entity });
      const autorDTO: AutorDTO = AutorAdapter.toDTO(entity);

      this.logService.info('Dados convertidos para DTO de retorno', { autorDTO });
      return createResult([autorDTO], 201, 'Autor criado com sucesso');
    } catch (error) {
      this.logService.error('Erro ao criar autor:', {}, error as Error);
      throw new Error('Falha ao criar autor.', { cause: error });
    }
  }
}
