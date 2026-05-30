import {
  LogService,
  PageDataType,
  UseCaseInterface,
  AutorInvalidoError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ExcluirAutorUseCase implements UseCaseInterface {
  private _tabelaAutores: string;
  private _tabelaLivros: string;
  private logService = new LogService('ExcluirAutorUseCase');

  constructor(private _repository: RepositoryInterface) {
    this.logService.info('🏁 Iniciando caso de uso de excluir autor.');
    this._tabelaAutores = process.env.TABELA_AUTORES || 'Autores';
    this._tabelaLivros = process.env.TABELA_LIVROS || 'Livros';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    const autorId = data.queryStringParameters?.id;
    if (!autorId) {
      this.logService.warn('ID do autor não fornecido.');
      throw new AutorInvalidoError('ID do autor é obrigatório para exclusão.');
    }
    const livrosDoAutor = await this._repository.getAll(this._tabelaLivros, {
      filterKey: 'autorId',
      filterValue: data.queryStringParameters?.id ?? '',
    });
    if (livrosDoAutor?.data && livrosDoAutor?.data.length > 0) {
      this.logService.warn(
        `Não é possível excluir o autor ${autorId} porque existem livros associados a ele.`
      );
      throw new AutorInvalidoError(
        'Não é possível excluir o autor porque existem livros associados a ele.'
      );
    }

    try {
      const result = await this._repository.deleteByMinhotecaId(
        this._tabelaAutores,
        data.queryStringParameters?.id ?? ''
      );
      return createResult(result.data, 200, 'Autor excluído com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir autor:', error);
      throw new Error('Falha ao excluir autor.');
    }
  }
}
