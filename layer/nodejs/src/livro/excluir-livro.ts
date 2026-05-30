import {
  LogService,
  PageDataType,
  UseCaseInterface,
  AutorInvalidoError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ExcluirLivroUseCase implements UseCaseInterface {
  private _tabelaLivros: string;
  private logService = new LogService('ExcluirLivroUseCase');

  constructor(private _repository: RepositoryInterface) {
    this._tabelaLivros = process.env.TABELA_LIVROS || 'Livros';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    this.logService.info('🏁 Iniciando caso de uso de excluir livro.');
    const livroId = data.queryStringParameters?.id;
    if (!livroId) {
      this.logService.warn('ID do livro não fornecido.');
      throw new AutorInvalidoError('ID do livro é obrigatório para exclusão.');
    }

    try {
      const result = await this._repository.deleteByMinhotecaId(
        this._tabelaLivros,
        data.queryStringParameters?.id ?? ''
      );
      return createResult(result.data, 200, 'Livro excluído com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir livro:', error);
      throw new Error('Falha ao excluir livro.');
    }
  }
}
