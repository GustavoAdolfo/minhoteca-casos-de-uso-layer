import {
  LogService,
  PageDataType,
  UseCaseInterface,
  EditoraInvalidaError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ExcluirEditoraUseCase implements UseCaseInterface {
  private _tabelaEditoras: string;
  private _tabelaLivros: string;
  private logService = new LogService('ExcluirEditoraUseCase');

  constructor(private _repository: RepositoryInterface) {
    this.logService.info('🏁 Iniciando caso de uso de excluir editora.');
    this._tabelaEditoras = process.env.TABELA_EDITORAS || 'Editoras';
    this._tabelaLivros = process.env.TABELA_LIVROS || 'Livros';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    const editoraId = data.queryStringParameters?.id;
    if (!editoraId) {
      this.logService.warn('ID da editora não fornecido.');
      throw new EditoraInvalidaError('ID da editora é obrigatório para exclusão.');
    }
    const livrosDaEditora = await this._repository.getAll(this._tabelaLivros, {
      filterKey: 'editoraId',
      filterValue: data.queryStringParameters?.id ?? '',
    });
    if (livrosDaEditora?.data && livrosDaEditora?.data.length > 0) {
      this.logService.warn(
        `Não é possível excluir a editora ${editoraId} porque existem livros associados a ela.`
      );
      throw new EditoraInvalidaError(
        'Não é possível excluir a editora porque existem livros associados a ela.'
      );
    }

    try {
      const result = await this._repository.deleteByMinhotecaId(
        this._tabelaEditoras,
        data.queryStringParameters?.id ?? ''
      );
      return createResult(result.data, 200, 'Editora excluída com sucesso.');
    } catch (error) {
      this.logService.error('Erro ao excluir editora:', {}, error as Error);
      throw new EditoraInvalidaError('Falha ao excluir editora.');
    }
  }
}
