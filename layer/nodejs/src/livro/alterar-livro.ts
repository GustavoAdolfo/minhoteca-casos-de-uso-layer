import {
  LivroDTO,
  LivroAdapter,
  UseCaseInterface,
  PageDataType,
  LogService,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import { createResult } from '../util/result.util';

export class AlterarLivroUseCase implements UseCaseInterface {
  private _tabelaLivros: string;
  private logService = new LogService('AlterarLivroUseCase');

  constructor(private _repository: RepositoryInterface) {
    this._tabelaLivros = process.env.TABELA_LIVROS || 'Livros';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    this.logService.info('Início a execução do caso de uso AlterarLivroUseCase', {}, { data });
    try {
      const dto = JSON.parse(data.body || '{}') as LivroDTO;
      if (!dto.id || dto.id.trim() === '') {
        throw new Error('ID do livro é obrigatório para alteração.');
      }

      const entity = LivroAdapter.fromCreateDTO(dto);
      const result = await this._repository.updateByMinhotecaId(
        this._tabelaLivros,
        JSON.parse(entity.toJSONString()),
        dto.id
      );
      return createResult(result.data, 200, 'Livro alterado com sucesso');
    } catch (error) {
      this.logService.error('Erro ao alterar livro:', { data }, error as Error);
      throw new Error('Falha ao alterar livro.');
    }
  }
}
