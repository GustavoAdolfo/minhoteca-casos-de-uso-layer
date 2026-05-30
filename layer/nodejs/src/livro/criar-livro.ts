import {
  LivroDTO,
  LivroAdapter,
  UseCaseInterface,
  PageDataType,
  LogService,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import { createResult } from '../util';

export class CriarLivroUseCase implements UseCaseInterface {
  private _tabelaLivros: string;
  private logService = new LogService('CriarLivroUseCase');

  constructor(private _repository: RepositoryInterface) {
    this._tabelaLivros = process.env.LIVRO_TABLE_NAME || 'Livros';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    this.logService.info('Início a execução do caso de uso CriarLivroUseCase', {}, { data });
    try {
      const body = JSON.parse(data.body ?? '{}');
      this.logService.info('Dados recebidos para gravação', {}, { body });

      const entity = LivroAdapter.fromCreateDTO(body);
      this.logService.info('Dados convertidos para entidade', { entity });

      await this._repository.saveData(this._tabelaLivros, JSON.parse(entity.toJSONString()));
      this.logService.info('Livro gravado com sucesso', { entity });
      const livroDTO: LivroDTO = LivroAdapter.toDTO(entity);

      this.logService.info('Dados convertidos para DTO de retorno', { livroDTO });
      return createResult([livroDTO], 201, 'Livro criado com sucesso');
    } catch (error) {
      this.logService.error('Erro ao criar livro:', {}, error as Error);
      throw new Error('Falha ao criar livro.', { cause: error });
    }
  }
}
