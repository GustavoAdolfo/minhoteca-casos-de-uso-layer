import {
  AutorDTO,
  AutorAdapter,
  UseCaseInterface,
  PageDataType,
  LogService,
  AutorInvalidoError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class AlterarAutorUseCase implements UseCaseInterface {
  private _tabelaAutores: string;
  private logService = new LogService('AlterarAutorUseCase');

  constructor(private _repository: RepositoryInterface) {
    this._tabelaAutores = process.env.TABELA_AUTORES || 'Autores';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    this.logService.info('Início a execução do caso de uso AlterarAutorUseCase', {}, { data });
    try {
      const dto = JSON.parse(data.body ?? '{}') as AutorDTO;
      if (!dto.id || dto.id.trim() === '') {
        this.logService.error('ID do Autor é obrigatório para alteração.');
        throw new AutorInvalidoError('ID do Autor é obrigatório para alteração.');
      }

      const entity = AutorAdapter.fromCreateDTO(dto);

      const result = await this._repository.updateByMinhotecaId(
        this._tabelaAutores,
        JSON.parse(entity.toJSONString()),
        dto.id
      );

      return createResult(result.data, 200, 'Autor alterado com sucesso');
    } catch (error) {
      this.logService.error('Erro ao alterar Autor:', {}, error as Error);
      throw new AutorInvalidoError('Falha ao alterar Autor.');
    }
  }
}
